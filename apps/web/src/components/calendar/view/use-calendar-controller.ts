"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrpcClient } from "@kyren/api/react";
import { toast } from "@kyren/ui/index";

import { addDays, addMonths, startOfDay, visibleDays, type ViewMode } from "../dates";
import type { CalendarEventItem, EventDraft, Occurrence } from "../event-dialog";
import { allDayToWire, onScreen, toDraft } from "./calendar-helpers";

export function useCalendarController() {
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
  }, [trpc, +from, +to]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => [...timeOff, ...events, ...meetings],
    [timeOff, events, meetings],
  );

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

  return {
    mode,
    setMode,
    anchor,
    setAnchor,
    days,
    events,
    failed,
    load,
    draft,
    setDraft,
    canCreate,
    shown,
    selected,
    step,
    blank,
    save,
    open,
    editOne,
    editFollowing,
    deleteFollowing,
    deleteOne,
    remove,
  };
}
