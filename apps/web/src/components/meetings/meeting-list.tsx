"use client";

import { useState } from "react";
import Link from "next/link";

import { useTrpcClient } from "@zentro/api/react";
import { EmptyState } from "@zentro/ui/components/empty-state";
import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { Input } from "@zentro/ui/shadcn/input";
import { Textarea } from "@zentro/ui/shadcn/textarea";
import { toastError } from "@zentro/ui/index";

import { useAsyncData } from "~/src/lib/use-async-data";

const when = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A value for a datetime-local input, an hour from now. */
function defaultStart() {
  const date = new Date(Date.now() + 3_600_000);

  date.setMinutes(0, 0, 0);

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

/** Meetings the person organizes or is invited to, and a form to schedule one. */
export function MeetingList({ canCreate }: { canCreate: boolean }) {
  const trpc = useTrpcClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [minutes, setMinutes] = useState("30");
  const [invited, setInvited] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const meetings = useAsyncData(
    () => trpc.meeting.list.query({ when: tab }),
    [trpc, tab],
  );
  const people = useAsyncData(() => trpc.member.getMembers.query(), [trpc]);

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      await trpc.meeting.create.mutate({
        title,
        agenda: agenda || undefined,
        startsAt: new Date(start),
        durationMinutes: Number(minutes),
        attendeeUserIds: invited,
      });
      setTitle("");
      setAgenda("");
      setInvited([]);
      setOpen(false);
      setTab("upcoming");
      meetings.reload();
    } catch (error) {
      toastError(error, "Could not schedule the meeting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <PageHeader
        title="Meetings"
        description="Video meetings with an agenda, shared notes and an AI recap."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen((value) => !value)}>
              Schedule a meeting
            </Button>
          ) : undefined
        }
      />

      {open ? (
        <form
          onSubmit={(event) => void schedule(event)}
          className="tile flex flex-col gap-3 px-5 py-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            Title
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Starts
              <Input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Minutes
              <Input
                type="number"
                min={5}
                max={480}
                className="w-24"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Agenda
            <Textarea
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              rows={3}
              maxLength={5000}
            />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Invite</legend>
            <div className="flex max-h-40 flex-col gap-1 overflow-auto">
              {(people.data ?? []).map((person) => (
                <label key={person.userId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={invited.includes(person.userId)}
                    onChange={(event) =>
                      setInvited((current) =>
                        event.target.checked
                          ? [...current, person.userId]
                          : current.filter((id) => id !== person.userId),
                      )
                    }
                  />
                  {person.name || person.email}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button type="submit" disabled={busy || !title.trim()}>
              Schedule
            </Button>
          </div>
        </form>
      ) : null}

      <div role="tablist" className="flex gap-2">
        {(["upcoming", "past"] as const).map((value) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            variant={tab === value ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(value)}
          >
            {value === "upcoming" ? "Upcoming" : "Past"}
          </Button>
        ))}
      </div>

      {meetings.status === "error" ? (
        <p role="alert" className="text-sm text-danger-text">
          Could not load your meetings.{" "}
          <button className="underline" onClick={meetings.reload}>
            Try again
          </button>
        </p>
      ) : meetings.status === "ready" && !meetings.data.length ? (
        <EmptyState
          title={
            tab === "upcoming" ? "No upcoming meetings" : "No past meetings"
          }
          description="Meetings you organize or are invited to show up here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {(meetings.data ?? []).map((meeting) => (
            <li key={meeting.id}>
              <Link
                href={`/calendar/meetings/${meeting.id}`}
                className="tile flex items-center justify-between gap-3 px-4 py-3 hover:bg-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">
                    {meeting.title}
                    {meeting.status === "canceled" ? " (canceled)" : ""}
                  </span>
                  <span className="text-sm text-ink-2">
                    {when.format(new Date(meeting.startsAt))} ·{" "}
                    {meeting.durationMinutes} min
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-3">
                  {meeting.response === "invited"
                    ? "Not answered"
                    : meeting.response}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
