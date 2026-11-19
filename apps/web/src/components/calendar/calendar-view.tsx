"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { useTrpcClient } from "@zentro/api/react";
import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { toast, toastError } from "@zentro/ui/index";

import {
  addDays,
  addMonths,
  sameDay,
  startOfDay,
  visibleDays,
  type ViewMode,
} from "./dates";
import {
  EventDialog,
  colors,
  type CalendarEventItem,
  type EventColor,
  type EventDraft,
  type Occurrence,
} from "./event-dialog";

const HOUR = 48;
const modes: ViewMode[] = ["month", "week", "day"];

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function colorClass(color: string) {
  return colors[(color in colors ? color : "blue") as EventColor];
}

/**
 * All-day events are kept as midnight UTC of their date, so the date is the
 * same for everyone; on screen they become that date's local midnight.
 */
function allDayToWire(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();
}

function allDayFromWire(iso: string) {
  const date = new Date(iso);

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ).toISOString();
}

function onScreen(event: CalendarEventItem): CalendarEventItem {
  return event.allDay
    ? {
        ...event,
        startsAt: allDayFromWire(event.startsAt),
        endsAt: allDayFromWire(event.endsAt),
      }
    : event;
}

function eventsOn(events: CalendarEventItem[], day: Date) {
  const start = +startOfDay(day);
  const end = +addDays(day, 1);
  return events.filter(
    (e) => +new Date(e.startsAt) < end && +new Date(e.endsAt) > start,
  );
}

/** Opening any occurrence edits the series, from its first dates. */
function toDraft(event: CalendarEventItem): EventDraft {
  const first = (wire: string | undefined, shown: string) =>
    new Date(wire ? (event.allDay ? allDayFromWire(wire) : wire) : shown);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    color: (event.color in colors ? event.color : "blue") as EventColor,
    allDay: event.allDay,
    startsAt: first(event.seriesStartsAt, event.startsAt),
    endsAt: first(event.seriesEndsAt, event.endsAt),
    repeat: event.repeat ?? null,
    repeatUntil: event.repeatUntil ?? null,
    occurrence: event.repeat
      ? {
          seriesId: event.id,
          startsAt: event.startsAt,
          shownStartsAt: new Date(
            event.allDay ? allDayFromWire(event.startsAt) : event.startsAt,
          ),
          shownEndsAt: new Date(
            event.allDay ? allDayFromWire(event.endsAt) : event.endsAt,
          ),
        }
      : undefined,
  };
}

export function CalendarView() {
  const trpc = useTrpcClient();
  const router = useRouter();
  const [meetings, setMeetings] = useState<CalendarEventItem[]>([]);
  const [timeOff, setTimeOff] = useState<CalendarEventItem[]>([]);
  const [mode, setMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [canCreate, setCanCreate] = useState(true);

  const days = useMemo(() => visibleDays(mode, anchor), [mode, anchor]);
  const from = days[0]!;
  const to = addDays(days[days.length - 1]!, 1);

  const load = useCallback(async () => {
    try {
      // A day either side, since all-day events sit at midnight UTC.
      const [found, booked] = await Promise.all([
        trpc.calendar.list.query({
          from: addDays(from, -1).toISOString(),
          to: addDays(to, 1).toISOString(),
        }),
        trpc.meeting.between.query({
          from: from.toISOString(),
          to: to.toISOString(),
        }),
      ]);

      setEvents(found.map(onScreen));
      setMeetings(
        booked
          .filter((meeting) => meeting.response !== "no")
          .map((meeting) => ({
            id: `meeting-${meeting.id}`,
            meetingId: meeting.id,
            title:
              meeting.status === "cancelled"
                ? `Cancelled: ${meeting.title}`
                : meeting.title,
            description: null,
            location: null,
            color: meeting.status === "cancelled" ? "gray" : "violet",
            allDay: false,
            startsAt: new Date(meeting.startsAt).toISOString(),
            endsAt: new Date(
              +new Date(meeting.startsAt) + meeting.durationMinutes * 60_000,
            ).toISOString(),
            createdBy: null,
            canManage: false,
          })),
      );
      setFailed(false);
    } catch {
      setFailed(true);
    }

    // Approved time off, when HR is on and the person can see it. The
    // calendar works the same without it.
    try {
      const day = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const away = await trpc.hr.timeOff.query({
        from: day(from),
        to: day(addDays(to, -1)),
      });

      setTimeOff(
        away.map((leave) => {
          const end = new Date(`${leave.endDate}T00:00:00.000Z`);

          end.setUTCDate(end.getUTCDate() + 1);

          return onScreen({
            id: `leave-${leave.id}`,
            title: leave.type
              ? `Out (${leave.type}): ${leave.name}`
              : `Out: ${leave.name}`,
            description: null,
            location: null,
            color: "amber",
            allDay: true,
            startsAt: `${leave.startDate}T00:00:00.000Z`,
            endsAt: end.toISOString(),
            createdBy: null,
            canManage: false,
            href: "/hr",
          });
        }),
      );
    } catch {
      setTimeOff([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trpc, +from, +to]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => [...timeOff, ...events, ...meetings],
    [timeOff, events, meetings],
  );

  /** Time off opens HR, a meeting its own page, an event the editor. */
  function open(event: CalendarEventItem) {
    if (event.href) router.push(event.href);
    else if (event.meetingId)
      router.push(`/calendar/meetings/${event.meetingId}`);
    else setDraft(toDraft(event));
  }

  const selected = draft?.id
    ? events.find((event) => event.id === draft.id)
    : undefined;

  function step(direction: -1 | 1) {
    setAnchor((current) =>
      mode === "month"
        ? addMonths(current, direction)
        : addDays(current, direction * (mode === "week" ? 7 : 1)),
    );
  }

  function blank(day: Date, hour?: number): EventDraft {
    const start = new Date(day);
    start.setHours(hour ?? 9, 0, 0, 0);
    return {
      title: "",
      description: null,
      location: null,
      color: "blue",
      allDay: hour === undefined && mode === "month",
      startsAt:
        hour === undefined && mode === "month" ? startOfDay(day) : start,
      endsAt:
        hour === undefined && mode === "month"
          ? addDays(startOfDay(day), 1)
          : new Date(start.getTime() + 36e5),
      repeat: null,
      repeatUntil: null,
    };
  }

  async function save(value: EventDraft) {
    const data = {
      title: value.title,
      description: value.description,
      location: value.location,
      color: value.color,
      allDay: value.allDay,
      startsAt: value.allDay
        ? allDayToWire(value.startsAt)
        : value.startsAt.toISOString(),
      endsAt: value.allDay
        ? allDayToWire(value.endsAt)
        : value.endsAt.toISOString(),
      repeat: value.repeat,
      repeatUntil: value.repeatUntil,
      // Repeats keep to this clock, across DST changes.
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    try {
      if (value.splitFrom) {
        await trpc.calendar.splitSeries.mutate({
          id: value.splitFrom.seriesId,
          startsAt: value.splitFrom.startsAt,
          data,
        });
      } else if (value.detachFrom) {
        await trpc.calendar.detachOccurrence.mutate({
          id: value.detachFrom.seriesId,
          startsAt: value.detachFrom.startsAt,
          data,
        });
      } else if (value.id) {
        await trpc.calendar.update.mutate({ id: value.id, data });
      } else {
        await trpc.calendar.create.mutate(data);
      }
    } catch (error) {
      if (error instanceof Error && /FORBIDDEN|permission/i.test(error.message))
        setCanCreate(false);
      throw error;
    }

    setDraft(null);
    toast.success(
      value.id || value.detachFrom || value.splitFrom
        ? "Event updated"
        : "Event added",
    );
    await load();
  }

  /** Reopens the editor on just this occurrence, as an event of its own. */
  function editOne(occurrence: Occurrence) {
    if (!draft) return;

    setDraft({
      ...draft,
      id: undefined,
      startsAt: occurrence.shownStartsAt,
      endsAt: occurrence.shownEndsAt,
      repeat: null,
      repeatUntil: null,
      occurrence: undefined,
      detachFrom: occurrence,
    });
  }

  /** Reopens the editor on this occurrence; saving changes it and the rest. */
  function editFollowing(occurrence: Occurrence) {
    if (!draft) return;

    setDraft({
      ...draft,
      id: undefined,
      startsAt: occurrence.shownStartsAt,
      endsAt: occurrence.shownEndsAt,
      occurrence: undefined,
      splitFrom: occurrence,
    });
  }

  async function deleteFollowing(occurrence: Occurrence) {
    if (
      !window.confirm("Delete this event and every one after it in the series?")
    ) {
      return;
    }

    await trpc.calendar.endSeries.mutate({
      id: occurrence.seriesId,
      startsAt: occurrence.startsAt,
    });
    setDraft(null);
    toast.success("Events deleted");
    await load();
  }

  async function deleteOne(occurrence: Occurrence) {
    await trpc.calendar.skipOccurrence.mutate({
      id: occurrence.seriesId,
      startsAt: occurrence.startsAt,
    });
    setDraft(null);
    toast.success("Event deleted");
    await load();
  }

  async function remove(id: string) {
    await trpc.calendar.remove.mutate({ id });
    setDraft(null);
    toast.success("Event deleted");
    await load();
  }

  const title =
    mode === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : mode === "day"
        ? anchor.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : `${days[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6]!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const today = new Date();

  function chip(event: CalendarEventItem) {
    const label = `${event.allDay ? "" : `${timeFormat.format(new Date(event.startsAt))} `}${event.title}`;

    // A phone's month cell is too narrow for text: the event shows as a
    // coloured bar there, and the name stays the button's label.
    return (
      <button
        key={`${event.id}-${event.startsAt}`}
        type="button"
        onClick={() => open(event)}
        aria-label={label}
        title={label}
        className={`h-2 w-full truncate rounded border text-left text-xs sm:h-auto sm:px-1.5 sm:py-0.5 ${colorClass(event.color)}`}
      >
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <PageHeader
        title="Calendar"
        description="Meetings, deadlines and time off, shared with your team."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/calendar/meetings">Meetings</Link>
            </Button>
            {canCreate ? (
              <Button
                onClick={() =>
                  setDraft(blank(new Date(), new Date().getHours() + 1))
                }
              >
                <PlusIcon aria-hidden />
                New event
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous"
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next"
          onClick={() => step(1)}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {title}
        </h2>
        <div className="ml-auto flex gap-1" role="group" aria-label="View">
          {modes.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "secondary" : "ghost"}
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className="capitalize"
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {failed ? (
        <p role="alert" className="text-sm">
          Events did not load.{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}

      {mode === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line">
          {days.slice(0, 7).map((day) => (
            <div
              key={+day}
              className="border-b border-line bg-sunken px-2 py-1.5 text-xs font-medium text-ink-2"
            >
              {day.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
          ))}
          {days.map((day) => {
            const list = eventsOn(shown, day);
            const outside = day.getMonth() !== anchor.getMonth();
            return (
              <div
                key={+day}
                className={`flex min-h-24 flex-col gap-1 border-r border-b border-line p-1.5 ${outside ? "bg-sunken/50 text-ink-3" : ""}`}
              >
                <button
                  type="button"
                  aria-label={`Add event on ${day.toDateString()}`}
                  onClick={() => canCreate && setDraft(blank(day))}
                  className={`self-start rounded-full px-1.5 text-xs ${sameDay(day, today) ? "bg-ink text-canvas" : ""}`}
                >
                  {day.getDate()}
                </button>
                {list.slice(0, 3).map(chip)}
                {list.length > 3 ? (
                  <button
                    type="button"
                    className="text-left text-xs text-ink-2 underline"
                    onClick={() => {
                      setAnchor(day);
                      setMode("day");
                    }}
                  >
                    +{list.length - 3} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <TimeGrid
          days={days}
          events={shown}
          today={today}
          onSlot={(day, hour) => canCreate && setDraft(blank(day, hour))}
          onEvent={open}
        />
      )}

      <EventDialog
        draft={draft}
        readOnly={Boolean(draft?.id && !selected?.canManage)}
        createdBy={selected?.createdBy}
        onClose={() => setDraft(null)}
        onSave={save}
        onEditOne={editOne}
        onDeleteOne={deleteOne}
        onEditFollowing={editFollowing}
        onDeleteFollowing={deleteFollowing}
        onDelete={async (id) => {
          try {
            await remove(id);
          } catch (error) {
            toastError(
              "Could not delete the event",
              error instanceof Error ? error.message : undefined,
            );
            throw error;
          }
        }}
      />
    </div>
  );
}

function TimeGrid({
  days,
  events,
  today,
  onSlot,
  onEvent,
}: {
  days: Date[];
  events: CalendarEventItem[];
  today: Date;
  onSlot: (day: Date, hour: number) => void;
  onEvent: (event: CalendarEventItem) => void;
}) {
  const cols = {
    gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <div className="min-w-[36rem]">
        <div className="grid border-b border-line bg-sunken" style={cols}>
          <div />
          {days.map((day) => (
            <div
              key={+day}
              className={`px-2 py-1.5 text-xs font-medium ${sameDay(day, today) ? "text-ink" : "text-ink-2"}`}
            >
              {day.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
              })}
            </div>
          ))}
        </div>

        <div className="grid border-b border-line" style={cols}>
          <div className="px-1 py-1 text-right text-[10px] text-ink-3">
            All day
          </div>
          {days.map((day) => (
            <div
              key={+day}
              className="flex flex-col gap-0.5 border-l border-line p-1"
            >
              {eventsOn(events, day)
                .filter((e) => e.allDay)
                .map((event) => (
                  <button
                    key={`${event.id}-${event.startsAt}`}
                    type="button"
                    onClick={() => onEvent(event)}
                    className={`truncate rounded border px-1.5 py-0.5 text-left text-xs ${colorClass(event.color)}`}
                  >
                    {event.title}
                  </button>
                ))}
            </div>
          ))}
        </div>

        <div className="relative grid" style={cols}>
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR }}
                className="pr-1 text-right text-[10px] text-ink-3"
              >
                {h === 0
                  ? ""
                  : timeFormat
                      .format(new Date(2000, 0, 1, h))
                      .replace(":00", "")}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayStart = +startOfDay(day);
            return (
              <div key={+day} className="relative border-l border-line">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`New event ${day.toDateString()} ${h}:00`}
                    style={{ height: HOUR }}
                    onClick={() => onSlot(day, h)}
                    className="block w-full border-b border-line/60 hover:bg-sunken"
                  />
                ))}
                {eventsOn(events, day)
                  .filter((e) => !e.allDay)
                  .map((event) => {
                    const s = Math.max(+new Date(event.startsAt), dayStart);
                    const e = Math.min(
                      +new Date(event.endsAt),
                      dayStart + 864e5,
                    );
                    const top = ((s - dayStart) / 36e5) * HOUR;
                    const height = Math.max(((e - s) / 36e5) * HOUR, 20);
                    return (
                      <button
                        key={`${event.id}-${event.startsAt}`}
                        type="button"
                        onClick={() => onEvent(event)}
                        style={{ top, height }}
                        className={`absolute inset-x-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left text-xs ${colorClass(event.color)}`}
                      >
                        <span className="font-medium">{event.title}</span>
                        <br />
                        {timeFormat.format(new Date(event.startsAt))}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
