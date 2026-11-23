"use client";

import { Label } from "@kyren/ui/shadcn/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kyren/ui/shadcn/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kyren/ui/shadcn/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@kyren/ui/shadcn/checkbox";
import { useState } from "react";
import Link from "next/link";

import { useTrpcClient } from "@kyren/api/react";
import { EmptyState } from "@kyren/ui/components/empty-state";
import { PageHeader } from "@kyren/ui/components/page-header";
import { Button } from "@kyren/ui/shadcn/button";
import { Input } from "@kyren/ui/shadcn/input";
import { Textarea } from "@kyren/ui/shadcn/textarea";
import { toastError } from "@kyren/ui/index";

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

const meetingSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200),
  agenda: z.string().max(5000),
  start: z
    .string()
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      "Enter a valid start date and time.",
    ),
  minutes: z.number().int().min(5).max(480),
  invited: z.array(z.string()),
});
type MeetingForm = z.infer<typeof meetingSchema>;

/** Meetings the person organizes or is invited to, and a form to schedule one. */
export function MeetingList({ canCreate }: { canCreate: boolean }) {
  const trpc = useTrpcClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [open, setOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MeetingForm>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: "",
      agenda: "",
      start: defaultStart(),
      minutes: 30,
      invited: [],
    },
  });
  const invited = watch("invited");

  const meetings = useAsyncData(
    () => trpc.meeting.list.query({ when: tab }),
    [trpc, tab],
  );
  const people = useAsyncData(() => trpc.member.getMembers.query(), [trpc]);

  const matches = (people.data ?? []).filter((person) =>
    `${person.name ?? ""} ${person.email}`
      .toLowerCase()
      .includes(inviteSearch.trim().toLowerCase()),
  );

  async function schedule({
    title,
    agenda,
    start,
    minutes,
    invited,
  }: MeetingForm) {
    try {
      await trpc.meeting.create.mutate({
        title,
        agenda: agenda || undefined,
        startsAt: new Date(start),
        durationMinutes: minutes,
        attendeeUserIds: invited,
      });
      reset({
        title: "",
        agenda: "",
        start: defaultStart(),
        minutes: 30,
        invited: [],
      });
      setInviteSearch("");
      setOpen(false);
      setTab("upcoming");
      meetings.reload();
    } catch (error) {
      toastError(error, "Could not schedule the meeting.");
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 p-6">
      <PageHeader
        title="Meetings"
        description="Video meetings with an agenda, shared notes and an AI recap."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>Schedule a meeting</Button>
          ) : undefined
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isSubmitting) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a meeting</DialogTitle>
            <DialogDescription>
              Choose a time and invite people from your workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={handleSubmit(schedule)}
            className="grid gap-4"
          >
            <Label className="grid gap-2 leading-normal">
              Title
              <Input
                {...register("title")}
                maxLength={200}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <span className="text-danger-text" role="alert">
                  {errors.title.message}
                </span>
              )}
            </Label>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Label className="grid min-w-0 gap-2 leading-normal">
                Starts
                <Input
                  type="datetime-local"
                  {...register("start")}
                  aria-invalid={!!errors.start}
                />
                {errors.start && (
                  <span className="text-danger-text" role="alert">
                    {errors.start.message}
                  </span>
                )}
              </Label>
              <Label className="grid gap-2 leading-normal">
                Minutes
                <Input
                  type="number"
                  min={5}
                  max={480}
                  {...register("minutes", { valueAsNumber: true })}
                  aria-invalid={!!errors.minutes}
                />
                {errors.minutes && (
                  <span className="text-danger-text" role="alert">
                    Enter 5 to 480 minutes.
                  </span>
                )}
              </Label>
            </div>
            <Label className="grid gap-2 leading-normal">
              Agenda
              <Textarea {...register("agenda")} rows={3} maxLength={5000} />
            </Label>
            <Collapsible className="rounded-lg border border-line">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between"
                >
                  Invite people <span>{invited.length} selected</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-2 border-t border-line p-3">
                <Input
                  type="search"
                  aria-label="Search invitees"
                  placeholder="Search by name or email"
                  value={inviteSearch}
                  onChange={(event) => setInviteSearch(event.target.value)}
                />
                <div className="grid max-h-44 gap-2 overflow-y-auto p-1">
                  {matches.map((person) => (
                    <Label
                      key={person.userId}
                      className="min-w-0 cursor-pointer py-1 leading-normal"
                    >
                      <Checkbox
                        checked={invited.includes(person.userId)}
                        onCheckedChange={(checked) =>
                          setValue(
                            "invited",
                            checked === true
                              ? [...invited, person.userId]
                              : invited.filter((id) => id !== person.userId),
                          )
                        }
                      />
                      <span className="min-w-0 truncate">
                        {person.name || person.email}
                      </span>
                    </Label>
                  ))}
                  {!matches.length && (
                    <p className="text-sm text-ink-2">
                      {people.status === "loading"
                        ? "Loading people…"
                        : "No matching people."}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
          <Button
            variant="custom"
            className="underline"
            onClick={meetings.reload}
          >
            Try again
          </Button>
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
