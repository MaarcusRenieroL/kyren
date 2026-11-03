const dueFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type Clock = { state: string; dueAt: string | null };

const tone: Record<string, string> = {
  due_soon: "bg-tint-sun text-ink",
  breached: "bg-danger-subtle text-danger-text",
  met: "bg-tint-teams text-ink",
  ok: "bg-sunken text-ink-2",
};

const words: Record<string, string> = {
  due_soon: "due soon",
  breached: "overdue",
  met: "on time",
  ok: "on track",
};

/**
 * One clock of a ticket's targets. Quiet when nothing is promised or all is
 * well, so only tickets that need attention stand out in the queue.
 */
export function SlaBadge({
  label,
  clock,
  alwaysShow = false,
}: {
  label: string;
  clock: Clock;
  alwaysShow?: boolean;
}) {
  if (clock.state === "none") return null;
  if (!alwaysShow && (clock.state === "ok" || clock.state === "met")) {
    return null;
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${tone[clock.state] ?? tone.ok}`}
      title={
        clock.dueAt ? `Due ${dueFormat.format(new Date(clock.dueAt))}` : ""
      }
    >
      {label} {words[clock.state] ?? clock.state}
    </span>
  );
}
