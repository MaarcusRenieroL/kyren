"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";

import { PageHeader } from "@zentro/ui/components/page-header";
import { Button } from "@zentro/ui/shadcn/button";
import { toastError } from "@zentro/ui/index";

import { startOfDay } from "./dates";
import { EventDialog } from "./event-dialog";
import { modes } from "./view/calendar-helpers";
import { MonthGrid } from "./view/month-grid";
import { TimeGrid } from "./view/time-grid";
import { useCalendarController } from "./view/use-calendar-controller";

export function CalendarView() {
  const {
    mode,
    setMode,
    anchor,
    setAnchor,
    days,
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
  } = useCalendarController();

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
          <Button
            variant="custom"
            className="underline"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </p>
      ) : null}

      {mode === "month" ? (
        <MonthGrid
          days={days}
          shown={shown}
          anchor={anchor}
          today={today}
          canCreate={canCreate}
          onOpenEvent={open}
          onSelectDay={(day) => setDraft(blank(day))}
          onViewDay={(day) => {
            setAnchor(day);
            setMode("day");
          }}
        />
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
